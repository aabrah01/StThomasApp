import FamilyForm from '@/components/FamilyForm';
import Link from 'next/link';

export default function NewFamilyPage() {
  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/families" className="hover:text-gray-900">Families</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">New Family</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Family</h1>
      <FamilyForm />
    </div>
  );
}
