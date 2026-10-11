import JoinTrip from '@/components/join-trip';
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinTrip code={code} />;
}
