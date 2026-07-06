import { Router, Route, Navigate } from "@solidjs/router";
import type { JSX } from "solid-js";
import { Header } from "./components/Header";
import { AlertSetup } from "./components/AlertSetup";
import { Nav } from "./components/Nav";
import { Footer } from "./components/Footer";
import Live from "./views/Live";
import DateView from "./views/DateView";
import Upcoming from "./views/Upcoming";
import Bracket from "./views/Bracket";
import Groups from "./views/Groups";

function Layout(props: { children?: JSX.Element }): JSX.Element {
  return (
    <div class="flex min-h-screen flex-col">
      <Header />
      <AlertSetup />
      <Nav />
      <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-10">{props.children}</main>
      <Footer />
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <Router root={Layout}>
      <Route path="/" component={Live} />
      <Route path="/date/:day?" component={DateView} />
      <Route path="/upcoming" component={Upcoming} />
      <Route path="/bracket" component={Bracket} />
      <Route path="/groups" component={Groups} />
      <Route path="*" component={() => <Navigate href="/" />} />
    </Router>
  );
}
