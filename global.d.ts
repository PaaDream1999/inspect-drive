// inspect-drive\global.d.ts

import React from "react";

declare module "react" {
  interface InputHTMLAttributes<T> extends React.HTMLAttributes<T> {
    webkitdirectory?: string;
  }
}
