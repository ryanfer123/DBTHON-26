import { useParams, useSearchParams } from "react-router";
import { Freshness } from "../../components/Freshness";
import { useAuth } from "../identity/AuthContext";
import { ListingForm } from "./ListingForm";
import { useQuery, type Listing, type Resource } from "./data";
import { Access, QueryStatus, Workspace } from "./Workspace";

export function ListingEditorPage() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const repeat = search.get("repeat");
  // Separate edit loading from the create form; never fetch a fictional listing.
  return (
    <Access roles={["Donor"]}>
      <Workspace
        title={id ? "Edit your listing" : "Share some food"}
        intro="Add the quantity, preparation time and collection deadline."
      >
        {id ? (
          <EditListing id={id} />
        ) : repeat && /^\d+$/.test(repeat) ? (
          <RepeatListing id={repeat} />
        ) : (
          <ListingForm />
        )}
      </Workspace>
    </Access>
  );
}
function EditListing({ id }: { id: string }) {
  const { session } = useAuth();
  const query = useQuery<Resource<Listing>>(`/listings/${id}`);
  return (
    <>
      <Freshness {...query} />
      <QueryStatus {...query} loading={query.loading && !query.data} />
      {query.data &&
        (query.data.data.donor_id === session!.user.user_id &&
        query.data.data.status === "Available" &&
        query.data.data.seconds_remaining > 0 ? (
          <ListingForm key={id} food={query.data.data} />
        ) : (
          <p className="notice">This listing can no longer be edited.</p>
        ))}
    </>
  );
}

function RepeatListing({ id }: { id: string }) {
  const { session } = useAuth();
  const query = useQuery<Resource<Listing>>(`/listings/${id}`);
  return (
    <>
      <QueryStatus {...query} />
      {query.data &&
        (query.data.data.donor_id === session!.user.user_id ? (
          <ListingForm key={id} food={query.data.data} repeat />
        ) : (
          <p className="notice">You can repeat only your own donations.</p>
        ))}
    </>
  );
}
