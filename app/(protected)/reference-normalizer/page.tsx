import { ReferenceNormalizerWorkspace } from "@/components/reference-normalizer/reference-normalizer-workspace";
import { getReferenceNormalizerConfig } from "@/lib/reference-normalizer-admin";

export default async function ReferenceNormalizerPage() {
  const config = await getReferenceNormalizerConfig();
  return <ReferenceNormalizerWorkspace initialConfig={config} />;
}
