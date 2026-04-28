'use client';

import { useRouter } from 'next/navigation';

interface Props {
  family: { id: string; family_name: string; membership_id: string; photo_url?: string; hoh_names?: string };
}

export function FamilyRow({ family: f }: Props) {
  const router = useRouter();

  return (
    <tr
      onClick={() => router.push(`/families/${f.id}`)}
      className="hover:bg-gray-50 transition-colors cursor-pointer"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {f.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#A83A42]/15 flex items-center justify-center text-xs font-bold text-[#5C1A1F]">
              {f.family_name?.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <span className="font-medium text-gray-900">{f.family_name}</span>
            {f.hoh_names && (
              <span className="block text-sm font-medium text-[#5C1A1F]">{f.hoh_names}</span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-gray-500">{f.membership_id}</td>
      <td className="px-4 py-3 text-right">
        <span className="text-[#5C1A1F] font-medium">Edit</span>
      </td>
    </tr>
  );
}
