import { Box, VStack } from "@hope-ui/solid"
import Upload from "~/pages/home/uploads/Upload"

const Index = () => {
  return (
    <VStack justifyContent="center" h="100vh" w="$full" px="$4">
      {/* $md wide at most: a fixed $md (448px) overflowed a phone */}
      <Box w="$full" maxW="$md">
        <Upload />
      </Box>
    </VStack>
  )
}

export default Index
