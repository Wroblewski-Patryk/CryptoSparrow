export default function Footer() {
  return (
    <footer className="border-t border-base-300/60 bg-base-200/70 text-center text-sm py-5 text-base-content/80">
      &copy; {new Date().getFullYear()} Soar. Wszystkie prawa zastrzeżone.
    </footer>
  );
}
