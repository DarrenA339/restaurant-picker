-- Deciding (build plan phase 9): after a batch's tally finds finalists but no
-- single unanimous winner, the session waits for the host to send the
-- finalists to the final round or deal 20 more. The tally claims the
-- transition swiping → deciding with a conditional update, so two members
-- finishing at once can't run it twice.
alter type public.session_status add value if not exists 'deciding' after 'swiping';
