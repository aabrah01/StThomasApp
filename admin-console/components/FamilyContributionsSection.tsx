import React from 'react';

interface Contribution {
  id: string;
  date: string;
  amount: number;
  category: string;
}

interface Props {
  contributions: Contribution[];
  // Requested amounts aren't stored per year, so they only apply to requestedYear
  categoryAmounts: Record<string, number>;
  requestedYear: number;
}

export default function FamilyContributionsSection({ contributions, categoryAmounts, requestedYear }: Props) {
  // Group by year, most recent first
  const byYear = contributions.reduce<Record<number, Contribution[]>>((acc, c) => {
    const year = new Date(c.date).getFullYear();
    (acc[year] ??= []).push(c);
    return acc;
  }, {});
  const requestedCategories = Object.keys(categoryAmounts);
  // A family that gave nothing this year still has requested amounts to show
  if (requestedCategories.length > 0) byYear[requestedYear] ??= [];
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Contributions</h2>
      </div>

      {years.length === 0 ? (
        <p className="px-6 py-8 text-sm text-gray-400 text-center">No contributions on record.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {years.map(year => {
            const rows = byYear[year];
            const total = rows.reduce((s, c) => s + c.amount, 0);
            return (
              <details key={year} open={year === years[0]}>
                <summary className="flex items-center justify-between px-6 py-3 cursor-pointer select-none hover:bg-gray-50">
                  <span className="text-sm font-semibold text-gray-700">{year}</span>
                  <span className="text-sm font-semibold text-[#5C1A1F]">
                    ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </summary>
                {(() => {
                  const byCategory = rows.reduce<Record<string, number>>((acc, c) => {
                    acc[c.category] = (acc[c.category] ?? 0) + c.amount;
                    return acc;
                  }, {});
                  const showRequested = year === requestedYear;
                  // A category with a requested amount still shows, at $0, when nothing was given to it
                  if (showRequested) requestedCategories.forEach(c => { byCategory[c] ??= 0; });
                  const categories = Object.entries(byCategory);
                  if (showRequested) {
                    categories.sort(([a], [b]) => (categoryAmounts[b] ?? -1) - (categoryAmounts[a] ?? -1) || a.localeCompare(b));
                  }
                  return (
                    <div className="border-t border-gray-100 text-sm grid grid-cols-[1fr_auto]">
                      {/* Total rollup row */}
                      <div className="px-6 py-2 bg-gray-50 font-semibold text-gray-800 border-b border-gray-50">Total Contributions</div>
                      <div className="px-6 py-2 bg-gray-50 font-semibold text-[#5C1A1F] tabular-nums text-right border-b border-gray-50">
                        ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      {/* Category rows — indented */}
                      {categories.map(([category, amount], i, arr) => (
                        <React.Fragment key={category}>
                          <div className={`pl-10 pr-4 py-2 text-gray-500 ${i < arr.length - 1 ? 'border-b border-gray-50' : ''}`}>
                            {category}
                          </div>
                          <div className={`px-6 py-2 text-gray-700 tabular-nums text-right ${i < arr.length - 1 ? 'border-b border-gray-50' : ''}`}>
                            ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            {showRequested && categoryAmounts[category] != null &&
                              ` of $${categoryAmounts[category].toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  );
                })()}
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
