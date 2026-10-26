import "./pwa.js";
import { TOOLS } from "./registry.js";

const slug = document.body.dataset.tool;
const tool = TOOLS.find((item) => item.slug === slug);
const title = document.querySelector("#soon-title");
const body = document.querySelector("#soon-body");

if (tool && title) title.textContent = tool.name;
if (tool && body) {
  body.textContent = `${tool.summary} 這個工具即將推出，完成後會留在這個資料夾。`;
}
if (tool) document.title = `${tool.name}｜即將推出`;
