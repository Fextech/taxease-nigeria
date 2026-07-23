/**
 * Formatting and data-organisation utilities shared between job handlers.
 */

export function formatKobo(koboVal: bigint | number): string {
    const naira = Number(koboVal) / 100;
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2,
    }).format(naira);
}

export function organizeTransactionsByMonth(transactions: any[]) {
    const months = new Map<string, any>();

    for (const tx of transactions) {
        const date = new Date(tx.transactionDate);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });

        if (!months.has(monthKey)) {
            months.set(monthKey, {
                monthName,
                grossIncome: 0n,
                directBusinessExpenses: 0n,
                otherExpenses: 0n,
                taxableIncome: 0n,
                transactions: [],
            });
        }

        const monthData = months.get(monthKey);

        const isCredit = tx.creditAmount > 0n;
        const amount = isCredit ? tx.creditAmount : tx.debitAmount;
        const taxableStatus = tx.annotation?.taxableStatus || 'NO';
        const isTaxable = taxableStatus === 'YES';
        const taxableAmount = tx.annotation?.taxableAmount || amount;

        if (isCredit && isTaxable) monthData.grossIncome += taxableAmount;
        if (!isCredit && isTaxable) monthData.directBusinessExpenses += taxableAmount;
        if (!isCredit && !isTaxable) monthData.otherExpenses += amount;

        const isDirectBusinessExpense = !isCredit && isTaxable;
        if (isCredit || isDirectBusinessExpense) {
            monthData.transactions.push({
                date: date.toLocaleDateString(),
                description: tx.description,
                amount: formatKobo(amount),
                isCredit,
                taxable: taxableStatus,
                reason: tx.annotation?.reason || '-',
            });
        }
    }

    return Array.from(months.values()).map((m) => ({
        ...m,
        grossIncome: formatKobo(m.grossIncome),
        directBusinessExpenses: formatKobo(m.directBusinessExpenses),
        otherExpenses: formatKobo(m.otherExpenses),
        taxableIncome: formatKobo(
            m.grossIncome > m.directBusinessExpenses
                ? m.grossIncome - m.directBusinessExpenses
                : 0n
        ),
    }));
}
