export default function Footer() {
  return (
    <footer className="bg-forest px-6 py-8 text-center">
      <p className="text-xs text-cream/30">
        &copy; {new Date().getFullYear()} Harald Solaas &mdash; harisolaas.com
      </p>
    </footer>
  );
}
