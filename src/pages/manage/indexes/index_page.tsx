import Indexes from "./indexes"
import Scan from "~/pages/manage/indexes/scan"

const IndexPage = () => {
  return (
    <div class="flex w-full flex-col gap-4">
      <Indexes />
      <Scan />
    </div>
  )
}

export default IndexPage
