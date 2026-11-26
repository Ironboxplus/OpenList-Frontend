export interface Meta {
  id: number
  path: string
  password: string
  read_users: number[]
  read_users_sub: boolean
  write_users: number[]
  write_users_sub: boolean
  p_sub: boolean
  write: boolean
  w_sub: boolean
  hide: string
  h_sub: boolean
  readme: string
  r_sub: boolean
  header: string
  header_sub: boolean
}

/**
 * A meta as the API sends it: the user lists are Go slices, which encode as
 * null when nobody was picked. Everything past this point gets arrays.
 */
export const metaFromApi = (m: Meta): Meta => ({
  ...m,
  read_users: m.read_users ?? [],
  write_users: m.write_users ?? [],
})
