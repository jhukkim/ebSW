import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App"

// 테마: 명시 선택(data-theme) 이 있으면 그것을, 없으면 OS 설정을 따른다. shadcn 은 .dark 클래스를 본다.
function applyTheme() {
  const root = document.documentElement
  const stamped = root.getAttribute("data-theme")
  const dark = stamped ? stamped === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches
  root.classList.toggle("dark", dark)
}
applyTheme()
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme)
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
