import React from "react";

export function createFileRoute(_path: string) {
  return function (opts: { component?: React.ComponentType<any> }) {
    return opts.component || (() => null);
  };
}

export function createRootRouteWithContext() {
  return function (_opts: any) {
    return {};
  };
}

export function notFound() {
  return new Error("Not Found");
}

export function redirect({ to }: { to: string }) {
  return new Error(`Redirect to ${to}`);
}
