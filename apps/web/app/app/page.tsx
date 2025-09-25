import { createClient } from '@/lib/supabase/server';
import { ThreeColumnLayout } from '@/components/ThreeColumnLayout';

export default async function AppPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // This will be caught by the layout redirect
  }

  return (
    <main className="h-[calc(100vh-4rem)] overflow-hidden">
      <ThreeColumnLayout userId={user.id} />
    </main>
  );
}