import { cn } from "@/lib/utils"
/** 필터 줄의 라벨 — 글자 + 컨트롤을 한 줄로 */
export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("flex items-center gap-1.5 text-xs text-foreground/80", className)} {...props} />
}
