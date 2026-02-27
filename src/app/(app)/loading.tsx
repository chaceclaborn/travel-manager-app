'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function AppLoading() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex items-center justify-center py-32"
    >
      <Loader2 className="size-8 animate-spin text-amber-500" />
    </motion.div>
  );
}
