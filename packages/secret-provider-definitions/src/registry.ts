import { makeSecretProviderDefinitionRegistry } from "@loom/secret-provider-core/shared/definition";
import * as OnePassword from "@loom/secret-provider-onepassword/shared/definition";

export const builtInSecretProviderDefinitions = makeSecretProviderDefinitionRegistry([
  OnePassword.definition,
]);
