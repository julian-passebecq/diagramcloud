
export type MacroProjectEntryProps = {
  onProject: (id: string) => void;
  onCreate: () => void;
  className?: string;
  comparisonAvailable?: boolean;
};

/** Entry points into the existing Project workspace. No document or navigation state lives here. */
export function MacroProjectEntry({onProject, onCreate, className, comparisonAvailable = false}: MacroProjectEntryProps) {
  return <section className={`macro-entry${className ? ` ${className}` : ''}`} aria-label="Commencer par la vue d’ensemble" lang="fr">
    <header className="macro-entry-heading">
      <span className="macro-entry-eyebrow">UN PROJET · PLUSIEURS VUES</span>
      <h2>Comprendre l’ensemble.<br/>Explorer le travail.</h2>
      <p>Reliez les applications, les données et les personnes dans un même projet.</p>
    </header>
    <p className="macro-entry-lenses">Architecture <span>·</span> Échanges <span>·</span> Workflows <span>·</span> Équipes <span>·</span> IA</p>
    <div className="macro-entry-projects">
      <button type="button" className="macro-entry-card macro-entry-foil" onClick={() => onProject('foilo-databricks')}>
        <span className="macro-entry-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16H5.5a3.5 3.5 0 0 1-.2-7A6 6 0 0 1 17 7.8 4.1 4.1 0 0 1 18.5 16H17"/><path d="M12 13v7m-4-3 4-4 4 4"/></svg>
        </span>
        <span className="macro-entry-copy"><strong>Foil · cloud</strong><small>Du système physique aux données et à l’application.</small></span>
        <span className="macro-entry-arrow" aria-hidden="true">↗</span>
      </button>
      <button type="button" className="macro-entry-card macro-entry-retail" onClick={() => onProject('retail-operations')}>
        <span className="macro-entry-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10c0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0"/><path d="M9 20v-5h6v5"/></svg>
        </span>
        <span className="macro-entry-copy"><strong>Retail · opérations</strong><small>Boutique, caisse, API et fichiers.<span className="macro-entry-example">Exemple fictif</span></small></span>
        <span className="macro-entry-arrow" aria-hidden="true">↗</span>
      </button>
      <button type="button" className="macro-entry-card" onClick={() => onProject('agent-systems-workmap')}>
        <span className="macro-entry-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="3" width="8" height="5" rx="1"/><rect x="2" y="16" width="8" height="5" rx="1"/><rect x="14" y="16" width="8" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/></svg>
        </span>
        <span className="macro-entry-copy"><strong>Agents · mémoire & travail</strong><small>Contexte partagé, profils et preuves à établir.<span className="macro-entry-example">Conception illustrative</span></small></span>
        <span className="macro-entry-arrow" aria-hidden="true">↗</span>
      </button>
    </div>
    <a className="macro-entry-catalogue" href="?catalogue" target="_blank" rel="noopener" title="Ouvrir le catalogue général dans un nouvel onglet">
      <span className="macro-entry-copy"><strong>Catalogue général</strong><small>Concepts, architectures et IA</small></span>
      <span aria-hidden="true">↗</span>
    </a>
    <button type="button" className="macro-entry-create" onClick={onCreate}><span aria-hidden="true">+</span> Décrire un nouveau projet</button>
    {comparisonAvailable && <a className="macro-entry-comparison" href="/comparison" target="_blank" rel="noopener">Comparer deux scénarios <span aria-hidden="true">↗</span><span className="macro-entry-new-tab"> · nouvel onglet</span></a>}
  </section>;
}
