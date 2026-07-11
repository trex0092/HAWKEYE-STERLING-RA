// Tweaks for the dark Hawkeye Sterling Entity Risk Assessment — accent, heading style, density.
const HS_DARK_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentDark": "#D2A648",
  "headingsDark": "Serif",
  "densityDark": "Comfortable"
}/*EDITMODE-END*/;

const HS_DARK_ACCENTS = ['#D2A648', '#C9863B', '#8FB3DC'];

function fgDarkHexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

function FGDarkTweaksApp() {
  const [t, setTweak] = useTweaks(HS_DARK_TWEAK_DEFAULTS);

  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--gold', t.accentDark);
    root.style.setProperty('--gold-dim', fgDarkHexToRgba(t.accentDark, 0.10));
    root.style.setProperty('--gold-ring', fgDarkHexToRgba(t.accentDark, 0.22));
    document.body.classList.toggle('heading-sans', t.headingsDark === 'Sans');
    document.body.classList.toggle('density-compact', t.densityDark === 'Compact');
  }, [t.accentDark, t.headingsDark, t.densityDark]);

  return (
    <TweaksPanel>
      <TweakSection label="Brand" />
      <TweakColor label="Accent" value={t.accentDark} options={HS_DARK_ACCENTS}
                  onChange={(v) => setTweak('accentDark', v)} />
      <TweakSection label="Typography" />
      <TweakRadio label="Headings" value={t.headingsDark} options={['Serif', 'Sans']}
                  onChange={(v) => setTweak('headingsDark', v)} />
      <TweakSection label="Layout" />
      <TweakRadio label="Density" value={t.densityDark} options={['Comfortable', 'Compact']}
                  onChange={(v) => setTweak('densityDark', v)} />
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById('tweaks-root')).render(<FGDarkTweaksApp />);
