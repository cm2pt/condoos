import { motion } from "framer-motion";

export default function AnimateSection({ children, keyName, disableAnimation = false }) {
  if (disableAnimation) {
    return <section className="screen capture-screen">{children}</section>;
  }

  return (
    <motion.section
      key={keyName}
      className="screen"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {children}
    </motion.section>
  );
}
