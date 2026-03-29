import { motion, AnimatePresence } from "framer-motion";

const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 30,
      delay: i * 0.03,
    },
  }),
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
};

/**
 * Tbody animado com stagger nas linhas.
 * Cada <tr> faz fade+slide ao entrar. Respeita prefers-reduced-motion
 * via Framer Motion nativo.
 *
 * Uso:
 *   <AnimatedTableBody>
 *     {rows.map((row, i) => (
 *       <AnimatedTableBody.Row key={row.id} index={i}>
 *         <td>...</td>
 *       </AnimatedTableBody.Row>
 *     ))}
 *   </AnimatedTableBody>
 */
export default function AnimatedTableBody({ children, className = "" }) {
  return (
    <AnimatePresence mode="popLayout">
      <tbody className={className}>{children}</tbody>
    </AnimatePresence>
  );
}

function AnimatedRow({ children, index = 0, className = "", ...props }) {
  return (
    <motion.tr
      className={className}
      variants={rowVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      custom={index}
      layout
      {...props}
    >
      {children}
    </motion.tr>
  );
}

AnimatedTableBody.Row = AnimatedRow;
