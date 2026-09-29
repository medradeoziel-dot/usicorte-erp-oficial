import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, Search, X } from 'lucide-react';
import { db, isNotFoundError } from '../lib/db';
import { MaterialItem, mapSupabaseToItem } from '../services/materialsService';

export interface AutocompleteOption {
  id: string;
  nome: string;
  tipo: 'chapa' | 'macico' | 'bucha';
  k: number;
  precoKg: number;
  sae?: string;
  norma?: string;
  descricao?: string;
  badge?: string;
}

interface MaterialAutocompleteProps {
  id?: string;
  value: string;
  onChangeText: (newText: string) => void;
  onSelectOption: (option: AutocompleteOption) => void;
  onAdvanceFocus?: () => void;
  options: AutocompleteOption[];
  placeholder?: string;
  inputClassName?: string;
  tabIndex?: number;
  required?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  currentK?: string | number;
  currentPriceKg?: string | number;
}

const normalizeStr = (str: string) =>
  (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export default function MaterialAutocomplete({
  id,
  value,
  onChangeText,
  onSelectOption,
  onAdvanceFocus,
  options,
  placeholder = 'Digite ex: oxi, 1045, aço...',
  inputClassName = '',
  tabIndex,
  required = false,
  inputRef: externalInputRef,
  currentK,
  currentPriceKg
}: MaterialAutocompleteProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [remoteMatches, setRemoteMatches] = useState<AutocompleteOption[]>([]);
  const [lastSelectedName, setLastSelectedName] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const activeInputRef = externalInputRef || internalInputRef;

  // Fecha menu suspenso ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Consulta em tempo real na tabela `materiais` do Supabase ao digitar
  useEffect(() => {
    const q = (value || '').trim();
    if (!isOpen || !q) {
      setRemoteMatches([]);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { data, error, status } = await db
          .from('materiais')
          .select('*')
          .order('nome', { ascending: true });

        if (isCancelled || error || status === 404 || isNotFoundError(error, status) || !Array.isArray(data)) {
          return;
        }

        const mapped: AutocompleteOption[] = data.map((row: any) => {
          const item: MaterialItem = mapSupabaseToItem(row);
          return {
            id: item.id,
            nome: item.nome,
            tipo: item.tipo,
            k: item.k,
            precoKg: item.precoKg,
            sae: row.sae ? String(row.sae) : item.sae || '',
            norma: row.norma ? String(row.norma) : item.norma || '',
            descricao: row.descricao ? String(row.descricao) : item.descricao || ''
          };
        });

        if (!isCancelled) {
          setRemoteMatches(mapped);
        }
      } catch {
        // Silencioso em modo offline
      }
    }, 120);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [value, isOpen]);

  // Mescla opções em memória + retorno em tempo real do Supabase sem duplicatas
  const mergedOptions = useMemo(() => {
    const map = new Map<string, AutocompleteOption>();
    remoteMatches.forEach(opt => {
      map.set(normalizeStr(opt.nome), opt);
    });
    options.forEach(opt => {
      const key = normalizeStr(opt.nome);
      if (!map.has(key)) {
        map.set(key, opt);
      }
    });
    return Array.from(map.values());
  }, [options, remoteMatches]);

  // Filtra em tempo real buscando em `nome`, `sae`, `norma` e `descricao`
  const filteredOptions = useMemo(() => {
    const rawQuery = (value || '').trim();
    const normQuery = normalizeStr(rawQuery);

    if (!normQuery) {
      return mergedOptions;
    }

    const tokens = normQuery.split(/\s+/).filter(Boolean);

    return mergedOptions
      .filter(opt => {
        const searchable = normalizeStr(
          `${opt.nome} ${opt.sae || ''} ${opt.norma || ''} ${opt.descricao || ''} ${opt.tipo} ${opt.k} ${String(opt.k).replace('.', ',')}`
        );
        if (searchable.includes(normQuery)) return true;
        return tokens.length > 0 && tokens.every(tok => searchable.includes(tok));
      })
      .sort((a, b) => {
        const aName = normalizeStr(a.nome);
        const bName = normalizeStr(b.nome);
        const aStarts = aName.startsWith(normQuery) ? 0 : 1;
        const bStarts = bName.startsWith(normQuery) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return aName.localeCompare(bName);
      });
  }, [mergedOptions, value]);

  // Mantém o item destacado visível na rolagem ao navegar com Setas
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-option-index="${highlightedIndex}"]`) as HTMLElement | null;
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (opt: AutocompleteOption) => {
    setLastSelectedName(opt.nome);
    setIsOpen(false);
    setHighlightedIndex(0);
    onSelectOption(opt);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center w-full">
        <input
          ref={activeInputRef as React.RefObject<HTMLInputElement>}
          id={id}
          type="text"
          value={value}
          tabIndex={tabIndex}
          required={required}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onClick={() => {
            setIsOpen(true);
          }}
          onChange={(e) => {
            const val = e.target.value;
            onChangeText(val);
            setHighlightedIndex(0);
            setIsOpen(true);
          }}
          onInput={(e) => {
            const val = (e.target as HTMLInputElement).value;
            onChangeText(val);
            setHighlightedIndex(0);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (!isOpen) {
                setIsOpen(true);
                setHighlightedIndex(0);
              } else if (filteredOptions.length > 0) {
                setHighlightedIndex(prev => (prev + 1) % filteredOptions.length);
              }
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (!isOpen) {
                setIsOpen(true);
                setHighlightedIndex(0);
              } else if (filteredOptions.length > 0) {
                setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
              }
            } else if (e.key === 'Enter' || e.key === 'Tab') {
              const normVal = normalizeStr(value);
              const normLast = normalizeStr(lastSelectedName);
              const isCustomizingSelected =
                Boolean(normLast) &&
                normVal.startsWith(normLast) &&
                normVal.length > normLast.length &&
                filteredOptions.length === 0;

              if (isOpen && filteredOptions.length > 0 && !isCustomizingSelected) {
                e.preventDefault();
                const targetOption = filteredOptions[highlightedIndex] || filteredOptions[0];
                handleSelect(targetOption);
                return;
              }

              // Caso seja texto livre customizado, preserva k e Preço/Kg já puxados e avança o foco
              setIsOpen(false);
              if (e.key === 'Enter') {
                e.preventDefault();
                if (onAdvanceFocus) {
                  onAdvanceFocus();
                }
              }
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setIsOpen(false);
            }
          }}
          className={inputClassName}
        />

        {value ? (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault();
              setLastSelectedName('');
              onChangeText('');
              setHighlightedIndex(0);
              setIsOpen(true);
              if (activeInputRef.current) {
                activeInputRef.current.focus();
              }
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer"
            title="Limpar campo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        )}
      </div>

      {/* Menu suspenso flutuante (z-50) */}
      {isOpen && (
        <div
          ref={listRef}
          className="absolute top-full left-0 w-full min-w-[280px] z-50 bg-slate-900 border border-slate-700 rounded-md shadow-2xl max-h-60 overflow-y-auto mt-1 divide-y divide-slate-800/80"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const isCurrentMatch = normalizeStr(value) === normalizeStr(opt.nome);
              return (
                <button
                  key={`${opt.id}-${opt.nome}-${idx}`}
                  type="button"
                  data-option-index={idx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(opt);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    isHighlighted
                      ? 'bg-indigo-600 text-white font-bold'
                      : isCurrentMatch
                      ? 'bg-slate-800 text-indigo-300 font-bold'
                      : 'text-slate-100 hover:bg-slate-800'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="truncate font-bold">{opt.nome}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                          isHighlighted
                            ? 'bg-indigo-800 text-indigo-100'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {opt.tipo === 'macico' ? 'Maciço' : opt.tipo === 'bucha' ? 'Bucha' : 'Chapa'}
                      </span>
                    </div>
                    {(opt.sae || opt.norma || opt.descricao) && (
                      <div
                        className={`text-[10px] truncate mt-0.5 ${
                          isHighlighted ? 'text-indigo-100' : 'text-slate-400'
                        }`}
                      >
                        {[opt.sae, opt.norma, opt.descricao].filter(Boolean).join(' • ')}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right font-mono">
                      <div className={`text-[10px] font-bold ${isHighlighted ? 'text-amber-200' : 'text-indigo-400'}`}>
                        k={opt.k}
                      </div>
                      <div className={`text-[10px] font-bold ${isHighlighted ? 'text-emerald-200' : 'text-emerald-400'}`}>
                        R$ {Number(opt.precoKg).toFixed(2).replace('.', ',')}/Kg
                      </div>
                    </div>
                    {(isHighlighted || isCurrentMatch) && (
                      <Check className={`w-3.5 h-3.5 shrink-0 ${isHighlighted ? 'text-white' : 'text-indigo-400'}`} />
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2.5 text-xs text-slate-300 bg-slate-900">
              <div className="font-semibold text-white">
                Descrição personalizada: <span className="text-indigo-400 uppercase">"{value}"</span>
              </div>
              {(currentK !== undefined || currentPriceKg !== undefined) && (
                <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                  Preservando k={currentK} • R$ {currentPriceKg}/Kg (Pressione ENTER para avançar)
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
