-- Browser capabilities stay private; delivery is atomic with the inbox event.
CREATE TABLE browser_push_subscriptions (
 subscription_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id bigint NOT NULL REFERENCES users,
 endpoint text NOT NULL UNIQUE CHECK(length(endpoint) BETWEEN 1 AND 2048),
 p256dh text NOT NULL CHECK(length(p256dh) BETWEEN 86 AND 88),
 auth text NOT NULL CHECK(length(auth) BETWEEN 22 AND 24),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE browser_push_deliveries (
 delivery_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 notification_id bigint NOT NULL REFERENCES notifications,
 subscription_id bigint NOT NULL REFERENCES browser_push_subscriptions ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'Pending' CHECK(status IN('Pending','Processing','Accepted','Failed')),
 lease_token uuid, locked_until timestamptz,
 UNIQUE(notification_id,subscription_id)
);
CREATE INDEX ix_push_user ON browser_push_subscriptions(user_id);
CREATE INDEX ix_push_pending ON browser_push_deliveries(delivery_id) WHERE status='Pending';
GRANT SELECT,INSERT,UPDATE,DELETE ON browser_push_subscriptions,browser_push_deliveries TO dbthon_guard;
GRANT USAGE,SELECT ON SEQUENCE browser_push_subscriptions_subscription_id_seq,browser_push_deliveries_delivery_id_seq TO dbthon_guard;
ALTER TABLE browser_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE browser_push_subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE browser_push_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE browser_push_deliveries FORCE ROW LEVEL SECURITY;
CREATE POLICY guard_scope ON browser_push_subscriptions TO dbthon_guard USING(true) WITH CHECK(true);
CREATE POLICY guard_scope ON browser_push_deliveries TO dbthon_guard USING(true) WITH CHECK(true);

CREATE FUNCTION dbthon_push_subscribe(target text,key_p256dh text,key_auth text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor bigint;
BEGIN
 actor:=public.dbthon_require_actor(true);
 PERFORM 1 FROM public.users WHERE user_id=actor FOR UPDATE;
 IF EXISTS(SELECT FROM public.browser_push_subscriptions WHERE endpoint=target AND user_id<>actor) THEN
  RAISE EXCEPTION 'PUSH_BROWSER_IN_USE';
 END IF;
 IF NOT EXISTS(SELECT FROM public.browser_push_subscriptions WHERE endpoint=target AND user_id=actor)
 AND (SELECT count(*) FROM public.browser_push_subscriptions WHERE user_id=actor)>=5 THEN
  RAISE EXCEPTION 'PUSH_DEVICE_LIMIT';
 END IF;
 INSERT INTO public.browser_push_subscriptions(user_id,endpoint,p256dh,auth) VALUES(actor,target,key_p256dh,key_auth)
 ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth WHERE browser_push_subscriptions.user_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'PUSH_BROWSER_IN_USE'; END IF;
 INSERT INTO public.notification_preferences(user_id,push_enabled) VALUES(actor,true)
 ON CONFLICT(user_id) DO UPDATE SET push_enabled=true,updated_at=clock_timestamp();
 PERFORM public.dbthon_record_event(ARRAY[actor],'push.browser_enabled','users',actor,NULL,jsonb_build_object('push',true));
END $$;
CREATE FUNCTION dbthon_push_unsubscribe(target text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor bigint;
BEGIN
 actor:=public.dbthon_require_actor(true);
 PERFORM 1 FROM public.users WHERE user_id=actor FOR UPDATE;
 DELETE FROM public.browser_push_subscriptions WHERE user_id=actor AND endpoint=target;
 IF NOT EXISTS(SELECT FROM public.browser_push_subscriptions WHERE user_id=actor) THEN
  UPDATE public.notification_preferences SET push_enabled=false,updated_at=clock_timestamp() WHERE user_id=actor;
 END IF;
 PERFORM public.dbthon_record_event(ARRAY[actor],'push.browser_disabled','users',actor,NULL,jsonb_build_object('push',false));
END $$;
CREATE FUNCTION dbthon_push_status(target text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT FROM public.browser_push_subscriptions s JOIN public.notification_preferences p USING(user_id)
 WHERE s.user_id=public.dbthon_actor_id() AND s.endpoint=target AND p.push_enabled);
$$;
CREATE FUNCTION dbthon_push_enqueue() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 INSERT INTO public.browser_push_deliveries(notification_id,subscription_id)
 SELECT NEW.notification_id,s.subscription_id FROM public.browser_push_subscriptions s
 JOIN public.notification_preferences p USING(user_id) WHERE s.user_id=NEW.user_id AND p.push_enabled;
 RETURN NEW;
END $$;
CREATE TRIGGER notification_push_enqueue AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION dbthon_push_enqueue();

CREATE FUNCTION dbthon_lease_browser_push() RETURNS TABLE(delivery_id bigint,lease_token uuid,endpoint text,p256dh text,auth text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 -- An interrupted send has an unknown outcome; never automatically duplicate it.
 UPDATE public.browser_push_deliveries SET status='Failed',lease_token=NULL,locked_until=NULL
 WHERE status='Processing' AND locked_until<clock_timestamp();
 UPDATE public.browser_push_deliveries d SET status='Failed' FROM public.notifications n
 WHERE d.notification_id=n.notification_id AND d.status='Pending'
 AND (n.created_at<clock_timestamp()-interval '30 minutes' OR n.hidden_at IS NOT NULL);
 RETURN QUERY WITH chosen AS (
 SELECT d.delivery_id FROM public.browser_push_deliveries d
 JOIN public.browser_push_subscriptions s USING(subscription_id)
 JOIN public.notifications n USING(notification_id)
 JOIN public.notification_preferences p ON p.user_id=s.user_id JOIN public.users u ON u.user_id=s.user_id
 WHERE d.status='Pending' AND p.push_enabled AND u.active AND n.hidden_at IS NULL
 AND n.created_at>clock_timestamp()-interval '30 minutes'
 ORDER BY d.delivery_id LIMIT 5 FOR UPDATE OF d SKIP LOCKED
 ), leased AS (
 UPDATE public.browser_push_deliveries d SET status='Processing',lease_token=public.gen_random_uuid(),locked_until=clock_timestamp()+interval '2 minutes'
 FROM chosen WHERE d.delivery_id=chosen.delivery_id RETURNING d.*)
 SELECT l.delivery_id,l.lease_token,s.endpoint,s.p256dh,s.auth FROM leased l JOIN public.browser_push_subscriptions s USING(subscription_id);
END $$;
CREATE FUNCTION dbthon_finish_browser_push(wanted bigint,token uuid,outcome text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE subscription bigint;
BEGIN
 IF outcome NOT IN('Accepted','Failed','Gone') THEN RETURN false; END IF;
 IF outcome='Gone' THEN
 -- Match revoke's subscription-before-delivery lock order.
 SELECT d.subscription_id INTO subscription FROM public.browser_push_deliveries d WHERE d.delivery_id=wanted;
 PERFORM 1 FROM public.browser_push_subscriptions s WHERE s.subscription_id=subscription FOR UPDATE;
 END IF;
 UPDATE public.browser_push_deliveries SET status=CASE WHEN outcome='Accepted' THEN 'Accepted' ELSE 'Failed' END,
 lease_token=NULL,locked_until=NULL WHERE delivery_id=wanted AND lease_token=token AND status='Processing'
 RETURNING subscription_id INTO subscription;
 IF subscription IS NULL THEN RETURN false; END IF;
 IF outcome='Gone' THEN DELETE FROM public.browser_push_subscriptions WHERE subscription_id=subscription; END IF;
 RETURN true;
END $$;
DO $$ DECLARE fn text; BEGIN
 FOREACH fn IN ARRAY ARRAY['dbthon_push_subscribe(text,text,text)','dbthon_push_unsubscribe(text)',
 'dbthon_push_status(text)','dbthon_push_enqueue()','dbthon_lease_browser_push()',
 'dbthon_finish_browser_push(bigint,uuid,text)'] LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO dbthon_guard',fn);
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',fn);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION dbthon_push_subscribe(text,text,text),dbthon_push_unsubscribe(text),dbthon_push_status(text) TO dbthon_runtime;
GRANT EXECUTE ON FUNCTION dbthon_lease_browser_push(),dbthon_finish_browser_push(bigint,uuid,text) TO dbthon_worker;

-- Account-wide opt-out discards queued alerts rather than replaying them on re-enable.
CREATE OR REPLACE FUNCTION dbthon_save_external_preferences(wants_sms boolean,wants_push boolean,wants_whatsapp boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor bigint;
BEGIN
 actor:=public.dbthon_require_actor(true);
 INSERT INTO public.notification_preferences(user_id,sms_enabled,push_enabled,whatsapp_enabled)
 VALUES(actor,wants_sms,wants_push,wants_whatsapp) ON CONFLICT(user_id) DO UPDATE SET
 sms_enabled=excluded.sms_enabled,push_enabled=excluded.push_enabled,whatsapp_enabled=excluded.whatsapp_enabled,updated_at=clock_timestamp();
 IF NOT wants_push THEN
 UPDATE public.browser_push_deliveries d SET status='Failed' FROM public.browser_push_subscriptions s
 WHERE d.subscription_id=s.subscription_id AND s.user_id=actor AND d.status='Pending';
 END IF;
 PERFORM public.dbthon_record_event(ARRAY[actor],'alerts.preference_saved','users',actor,NULL,
 jsonb_build_object('sms',wants_sms,'whatsapp',wants_whatsapp,'push',wants_push));
END $$;
