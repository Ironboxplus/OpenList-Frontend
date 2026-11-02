/** One login session, as GET /me/sessions and /admin/session/list return it. */
export interface Session {
  session_id: string
  /** Only in the admin list. */
  user_id?: number
  client_id: string
  /** Unix seconds. */
  created_at: number
  last_active: number
  ua: string
  /** Already masked by the backend, e.g. 1.*.*.4. */
  ip: string
  /** The session of the token that made the request. */
  current: boolean
}
