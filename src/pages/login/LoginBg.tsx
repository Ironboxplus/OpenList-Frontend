import CornerBottom from "./CornerBottom"
import CornerTop from "./CornerTop"

const LoginBg = () => {
  return (
    <div class="fixed top-0 left-0 -z-1 h-screen w-screen overflow-hidden bg-[#a9c6ff] dark:bg-[#062b74]">
      <div class="absolute right-[-100px] sm:right-[-300px] top-[-1170px] sm:top-[-900px]">
        <CornerTop />
      </div>
      <div class="absolute left-[-100px] sm:left-[-200px] bottom-[-760px] sm:bottom-[-400px]">
        <CornerBottom />
      </div>
    </div>
  )
}

export default LoginBg
