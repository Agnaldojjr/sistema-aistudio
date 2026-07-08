const fs = require('fs');

let content = fs.readFileSync('src/components/MobileWorkspace.tsx', 'utf8');

// 1. Add imports
if (!content.includes("import CalendarView")) {
  content = content.replace(
    "import { format, parseISO, addMinutes } from 'date-fns';",
    "import { format, parseISO, addMinutes } from 'date-fns';\nimport CalendarView from './CalendarView';\nimport DentalCRMView from './DentalCRMView';\nimport ProposalViewer from './ProposalViewer';\nimport { FileSpreadsheet } from 'lucide-react';"
  );
}

// 2. Change activeTab state
content = content.replace(
  "const [activeTab, setActiveTab] = useState<'leads' | 'camera'>('leads');",
  "const [activeTab, setActiveTab] = useState<'leads' | 'camera' | 'agenda' | 'orcamentos' | 'crm'>('leads');"
);

// 3. Add Bottom Navigation before final closing div
const bottomNav = `
      {/* BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-50 pb-safe">
        <div className="flex items-center justify-between px-2 py-2 max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('leads')}
            className={\`flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all \${activeTab === 'leads' ? 'text-[#8B0000] bg-rose-50' : 'text-zinc-400'}\`}
          >
            <User className="w-5 h-5" />
            <span className="text-[9px] font-bold">Leads</span>
          </button>
          
          <button
            onClick={() => setActiveTab('agenda')}
            className={\`flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all \${activeTab === 'agenda' ? 'text-[#8B0000] bg-rose-50' : 'text-zinc-400'}\`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[9px] font-bold">Agenda</span>
          </button>

          <button
            onClick={() => setActiveTab('camera')}
            className={\`flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all \${activeTab === 'camera' ? 'text-[#8B0000] bg-rose-50' : 'text-zinc-400'}\`}
          >
            <Camera className="w-5 h-5" />
            <span className="text-[9px] font-bold">Câmera</span>
          </button>

          <button
            onClick={() => setActiveTab('crm')}
            className={\`flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all \${activeTab === 'crm' ? 'text-[#8B0000] bg-rose-50' : 'text-zinc-400'}\`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[9px] font-bold">CRM</span>
          </button>

          <button
            onClick={() => setActiveTab('orcamentos')}
            className={\`flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all \${activeTab === 'orcamentos' ? 'text-[#8B0000] bg-rose-50' : 'text-zinc-400'}\`}
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="text-[9px] font-bold">Orçamentos</span>
          </button>
        </div>
      </div>
`;

// remove existing simple top tabs if they exist
content = content.replace(
  /<div className="flex bg\[#FAF8F5\] p-1\.5 rounded-xl border border-zinc-200 mb-6">[\s\S]*?<\/div>/,
  ""
);

// Inject content for new tabs
const injectionPoint = `{activeTab === 'camera' && (`;

const newTabsContent = `
        {activeTab === 'agenda' && (
          <div className="bg-white border border-[#E6DEC9] rounded-2xl shadow-sm overflow-hidden h-[calc(100vh-140px)]">
            <CalendarView clinicSettings={clinicSettings} isMobile={true} />
          </div>
        )}

        {activeTab === 'crm' && (
          <div className="bg-white border border-[#E6DEC9] rounded-2xl shadow-sm overflow-hidden h-[calc(100vh-140px)]">
            <DentalCRMView isMobile={true} />
          </div>
        )}

        {activeTab === 'orcamentos' && (
          <div className="bg-white border border-[#E6DEC9] rounded-2xl shadow-sm overflow-hidden p-2 pb-24">
            <h3 className="text-sm font-bold text-[#8B0000] mb-2">Orçamento Atual</h3>
            <ProposalViewer proposal={proposal} procedures={procedures} isMobile={true} />
          </div>
        )}

        ${injectionPoint}
`;

content = content.replace(injectionPoint, newTabsContent);

// Add pb-24 to the main wrapper to avoid content hiding under bottom nav
content = content.replace(
  'className="max-w-md mx-auto"',
  'className="max-w-md mx-auto pb-24"'
);

// Add bottom nav before the very last </div>
content = content.replace(/<\/div>\s*<\/div>\s*\);\s*}\s*$/, bottomNav + "\n      </div>\n    </div>\n  );\n}\n");

fs.writeFileSync('src/components/MobileWorkspace.tsx', content);
console.log('MobileWorkspace.tsx rewritten successfully!');
