-- Opt-in external alerts, with a worker-only demo recipient and daily budget gate.
ALTER TABLE notification_preferences ADD COLUMN whatsapp_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE notification_outbox DROP CONSTRAINT notification_outbox_channel_check;
ALTER TABLE notification_outbox ADD CONSTRAINT notification_outbox_channel_check CHECK(channel IN('InApp','SMS','Push','WhatsApp'));
ALTER TABLE notification_outbox ADD COLUMN provider_sid text, ADD COLUMN provider_status text;
CREATE TABLE external_alert_budget (day date PRIMARY KEY, reserved integer NOT NULL CHECK(reserved>=0));
GRANT SELECT,INSERT,UPDATE ON external_alert_budget TO dbthon_guard;
ALTER TABLE external_alert_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_alert_budget FORCE ROW LEVEL SECURITY;
CREATE POLICY guard_scope ON external_alert_budget TO dbthon_guard USING(true) WITH CHECK(true);

CREATE FUNCTION dbthon_external_enqueue() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 INSERT INTO public.notification_outbox(notification_id,channel)
 SELECT NEW.notification_id,chosen FROM public.notification_preferences p
 CROSS JOIN LATERAL (VALUES ('SMS',p.sms_enabled),('WhatsApp',p.whatsapp_enabled)) channels(chosen,wants)
 WHERE p.user_id=NEW.user_id AND wants ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
ALTER FUNCTION dbthon_external_enqueue() OWNER TO dbthon_guard;
REVOKE ALL ON FUNCTION dbthon_external_enqueue() FROM PUBLIC;
CREATE TRIGGER notification_external_enqueue AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION dbthon_external_enqueue();

CREATE FUNCTION dbthon_save_external_preferences(wants_sms boolean,wants_push boolean,wants_whatsapp boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor bigint;
BEGIN
 actor:=public.dbthon_require_actor(true);
 INSERT INTO public.notification_preferences(user_id,sms_enabled,push_enabled,whatsapp_enabled)
 VALUES(actor,wants_sms,wants_push,wants_whatsapp) ON CONFLICT(user_id) DO UPDATE SET
 sms_enabled=excluded.sms_enabled,push_enabled=excluded.push_enabled,whatsapp_enabled=excluded.whatsapp_enabled,updated_at=clock_timestamp();
 PERFORM public.dbthon_record_event(ARRAY[actor],'alerts.preference_saved','users',actor,NULL,
 jsonb_build_object('sms',wants_sms,'whatsapp',wants_whatsapp,'push',wants_push));
END $$;

CREATE FUNCTION dbthon_lease_external_alerts(allowed_phones text[],supported_channels text[],daily_limit integer)
RETURNS TABLE(outbox_id bigint,lease_token uuid,channel text,phone text,message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE reserved_today integer; remaining integer; chosen_ids bigint[];
BEGIN
 IF cardinality(allowed_phones)<>1 OR daily_limit NOT BETWEEN 1 AND 10 THEN RETURN; END IF;
 INSERT INTO public.external_alert_budget(day,reserved) VALUES((clock_timestamp() AT TIME ZONE 'UTC')::date,0) ON CONFLICT DO NOTHING;
 SELECT reserved INTO reserved_today FROM public.external_alert_budget WHERE day=(clock_timestamp() AT TIME ZONE 'UTC')::date FOR UPDATE;
 remaining:=daily_limit-reserved_today;
 IF remaining<=0 THEN RETURN; END IF;
 -- Timed-out sends are uncertain: do not automatically duplicate them.
 UPDATE public.notification_outbox o SET status='Failed',locked_until=NULL,lease_token=NULL,last_error='External send outcome unknown'
 WHERE o.channel IN('SMS','WhatsApp') AND o.status='Processing' AND o.locked_until<=clock_timestamp();
 SELECT array_agg(candidate.outbox_id) INTO chosen_ids FROM (
 SELECT o.outbox_id FROM public.notification_outbox o JOIN public.notifications n USING(notification_id)
 JOIN public.users u USING(user_id) JOIN public.notification_preferences p USING(user_id)
 WHERE o.status='Pending' AND o.channel=ANY(supported_channels) AND o.channel IN('SMS','WhatsApp')
 AND o.next_attempt_at<=clock_timestamp() AND n.created_at>clock_timestamp()-interval '30 minutes'
 AND u.phone=ANY(allowed_phones) AND u.active AND n.hidden_at IS NULL
 AND ((o.channel='SMS' AND p.sms_enabled) OR (o.channel='WhatsApp' AND p.whatsapp_enabled))
 ORDER BY o.outbox_id FOR UPDATE OF o SKIP LOCKED LIMIT least(remaining,3)) candidate;
 UPDATE public.external_alert_budget SET reserved=reserved+coalesce(cardinality(chosen_ids),0)
 WHERE day=(clock_timestamp() AT TIME ZONE 'UTC')::date;
 RETURN QUERY UPDATE public.notification_outbox o SET status='Processing',attempts=attempts+1,
 locked_until=clock_timestamp()+interval '60 seconds',lease_token=public.gen_random_uuid()
 FROM public.notifications n,public.users u WHERE o.outbox_id=ANY(chosen_ids) AND n.notification_id=o.notification_id AND u.user_id=n.user_id
 RETURNING o.outbox_id,o.lease_token,o.channel::text,u.phone::text,n.message::text;
END $$;

CREATE FUNCTION dbthon_finish_external_alert(wanted_id bigint,token uuid,sid text,provider_state text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 UPDATE public.notification_outbox SET status=CASE WHEN sid IS NULL THEN 'Failed' ELSE 'Sent' END,
 provider_sid=sid,provider_status=provider_state,locked_until=NULL,lease_token=NULL,
 last_error=CASE WHEN sid IS NULL THEN 'Provider did not confirm acceptance; no automatic resend' END
 WHERE outbox_id=wanted_id AND lease_token=token AND status='Processing' AND channel IN('SMS','WhatsApp');
 RETURN FOUND;
END $$;
CREATE FUNCTION dbthon_external_receipts() RETURNS TABLE(outbox_id bigint,provider_sid text)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT o.outbox_id,o.provider_sid FROM public.notification_outbox o JOIN public.notifications n USING(notification_id)
 WHERE o.channel IN('SMS','WhatsApp') AND o.status='Sent' AND o.provider_status NOT IN('delivered','read','failed','undelivered')
 AND n.created_at>clock_timestamp()-interval '1 hour' ORDER BY o.outbox_id LIMIT 3;
$$;
CREATE FUNCTION dbthon_record_external_receipt(wanted_id bigint,sid text,state text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 UPDATE public.notification_outbox SET provider_status=state WHERE outbox_id=wanted_id AND provider_sid=sid AND channel IN('SMS','WhatsApp');
$$;
DO $$ DECLARE fn text; BEGIN
 FOREACH fn IN ARRAY ARRAY['dbthon_save_external_preferences(boolean,boolean,boolean)',
 'dbthon_lease_external_alerts(text[],text[],integer)','dbthon_finish_external_alert(bigint,uuid,text,text)',
 'dbthon_external_receipts()','dbthon_record_external_receipt(bigint,text,text)'] LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO dbthon_guard',fn);
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',fn);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION dbthon_save_external_preferences(boolean,boolean,boolean) TO dbthon_runtime;
GRANT EXECUTE ON FUNCTION dbthon_lease_external_alerts(text[],text[],integer),dbthon_finish_external_alert(bigint,uuid,text,text),
 dbthon_external_receipts(),dbthon_record_external_receipt(bigint,text,text) TO dbthon_worker;
