create extension if not exists vector;

create or replace function public.insert_document_chunk(
  p_document_id uuid,
  p_content text,
  p_embedding vector(384),
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.document_chunks (id, document_id, content, embedding, metadata)
  values (gen_random_uuid(), p_document_id, p_content, p_embedding, p_metadata);
end;
$$;

create or replace function public.match_document_chunks(
  query_embedding vector(384),
  match_count integer,
  p_session_id uuid
)
returns table (
  document_id uuid,
  content text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  where d.session_id = p_session_id
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks using hnsw (embedding vector_cosine_ops);

grant usage on schema public to anon, authenticated, service_role;

grant select on public.documents, public.document_chunks to anon, authenticated, service_role;

grant execute on function public.insert_document_chunk(uuid, text, vector, jsonb)
  to anon, authenticated, service_role;

grant execute on function public.match_document_chunks(vector, integer, uuid)
  to anon, authenticated, service_role;