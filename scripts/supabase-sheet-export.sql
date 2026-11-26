-- One consistent, read-only snapshot for restoring cell records to new Sheets files.
-- Download all results as CSV. Do not post the export in chat.
WITH snapshot AS (
 SELECT d.id,d.revision,
        (SELECT count(*) FROM public.logbook_books b WHERE b.dataset_id=d.id) AS expected_books,
        (SELECT count(*) FROM public.logbook_sheets s WHERE s.dataset_id=d.id) AS expected_sheets,
        (SELECT count(*) FROM public.logbook_rows r WHERE r.dataset_id=d.id) AS expected_rows
 FROM public.logbook_datasets d
 WHERE d.id='0b165638-14b3-4b1f-a867-97cba6e57c57'::uuid
), chunks AS (
 SELECT r.dataset_id,r.book_id,r.sheet_id,(r.row_number-1)/100 AS chunk,
        jsonb_agg(r.payload ORDER BY r.row_number) AS payload,count(*) AS chunk_rows
 FROM public.logbook_rows r
 JOIN snapshot d ON d.id=r.dataset_id
 GROUP BY r.dataset_id,r.book_id,r.sheet_id,(r.row_number-1)/100
)
SELECT d.revision,d.expected_books,d.expected_sheets,d.expected_rows,
       b.id AS book_id,b.metadata AS book_metadata,
       s.id AS sheet_id,s.title,s.position,s.columns_count,s.rows_count,s.revision AS sheet_revision,
       COALESCE(c.chunk,0) AS chunk,COALESCE(c.chunk_rows,0) AS chunk_rows,
       COALESCE(c.payload,'[]'::jsonb) AS payload
FROM snapshot d
JOIN public.logbook_books b ON b.dataset_id=d.id
JOIN public.logbook_sheets s ON s.dataset_id=b.dataset_id AND s.book_id=b.id
LEFT JOIN chunks c ON c.dataset_id=s.dataset_id AND c.book_id=s.book_id AND c.sheet_id=s.id
ORDER BY b.id,s.position,c.chunk;
