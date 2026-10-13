import { r } from "~/utils"
import type { PResp } from "~/types"
import type { Favorite } from "./data"

/** The signed-in user's favorites, in the order the backend keeps them. */
export const fetchFavorites = (): PResp<Favorite[]> => r.get("/me/favorites")
