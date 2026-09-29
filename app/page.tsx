import { getChatGPTUser } from "./chatgpt-auth";
import StudyShell from "./study-shell";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <StudyShell
      signedIn={Boolean(user)}
      userKey={user?.userId ?? "anonymous"}
    />
  );
}
