import * as React from "react";
import { Switch, Route } from "wouter";

const Probe = React.lazy(() => import("@/pages/_probe"));

export function getRouter() {
  return (
    <Switch>
      <Route path="/" component={Probe} />
    </Switch>
  );
}