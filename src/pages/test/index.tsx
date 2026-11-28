import Upload from "~/pages/home/uploads/Upload"

const Index = () => {
  return (
    <div class="flex flex-col items-center justify-center h-screen w-full px-4">
      {/* $md wide at most: a fixed $md (448px) overflowed a phone */}
      <div class="w-full max-w-md">
        <Upload />
      </div>
    </div>
  )
}

export default Index
