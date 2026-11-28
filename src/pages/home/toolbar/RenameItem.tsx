import { MotionDiv, MotionTokens } from "~/platform/motion"
import { RenameObj } from "~/types"

export const RenameItem = (props: { obj: RenameObj; index: number }) => {
  return (
    <MotionDiv
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      timing={MotionTokens.options.barEnter}
      style={{
        width: "100%",
      }}
    >
      <div class="list-item flex w-full items-center rounded-lg p-2 transition-all duration-300 hover:scale-[1.01] hover:bg-accent">
        <p class="name w-1/2 truncate" title={props.obj.src_name}>
          {props.obj.src_name}
        </p>

        <p class="name w-1/2 truncate" title={props.obj.new_name}>
          {props.obj.new_name}
        </p>
      </div>
    </MotionDiv>
  )
}
