import * as React from "react";
import { Switch, Route } from "wouter";

const Home = React.lazy(() => import("@/pages/main"));

export function getRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
    </Switch>
  );
}