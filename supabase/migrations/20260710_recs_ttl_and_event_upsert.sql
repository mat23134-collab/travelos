-- Enable per-window upsert for events (instead of delete-all) so events from
-- different trip date windows coexist rather than overwriting each other.
-- (Restaurants/attractions are date-independent and keep their replace-city
-- write; freshness for all three is handled by a TTL stale-while-revalidate in
-- the read path — see src/lib/recStaleness.ts.)
create unique index if not exists event_recommendations_city_name_date_uidx
  on public.event_recommendations(city_normalized, name_normalized, start_date);
