export default function Footer() {
  return (
    <footer className=" text-center text-sm text-gray-500 dark:text-gray-400 py-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      © {new Date().getFullYear()} CryptoSparrow. Wszelkie prawa zastrzeżone.
    </footer>
  );
} 