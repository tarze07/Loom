// The production icon, as GitHub shows the Loom app, whatever this build's channel.
import appIconUrl from "../../../../assets/prod/loom-black-web-apple-touch-180.png";

export function LoomAppIcon(props: { readonly className?: string }) {
  return <img src={appIconUrl} alt="" className={props.className} />;
}
