import { AuthView } from "@clerk/expo/native";
import { View } from "react-native";

// Clerk's native sign-in / sign-up UI (Apple, Google, email, passkeys per dashboard config).
// The root AuthGate redirects as soon as a session exists.
export default function SignIn() {
  return (
    <View style={{ flex: 1 }}>
      <AuthView mode="signInOrUp" isDismissible={false} />
    </View>
  );
}
