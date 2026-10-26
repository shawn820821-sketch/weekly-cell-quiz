import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "주간 셀 퀴즈",
    short_name: "주간 셀 퀴즈",
    description: "함께 말씀을 복습하고 매주 순위를 확인하는 주간 셀 퀴즈",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f2eddf",
    theme_color: "#163249",
    icons: [{ src:"/icon.svg", sizes:"any", type:"image/svg+xml", purpose:"any" }]
  };
}
