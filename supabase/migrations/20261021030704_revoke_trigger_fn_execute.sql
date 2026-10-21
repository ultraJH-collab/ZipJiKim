-- 트리거 전용 함수는 API(RPC)로 호출되지 않도록 실행 권한 회수
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.force_server_time() from public, anon, authenticated;
revoke execute on function public.seals_immutable() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
