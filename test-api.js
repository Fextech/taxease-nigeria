fetch("http://localhost:3001/trpc/admin.billing.getPricingConfig")
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
