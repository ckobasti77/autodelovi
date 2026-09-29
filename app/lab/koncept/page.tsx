// /lab/koncept — step 03 concept frames for the „Rendgen“ design direction (noindex).
// Hero composition at mid fidelity (static X-ray drawing where the 3D goes), product cards,
// and the admin orders table. Step 04 redirects this route to /styleguide.
import type { Metadata, Viewport } from "next";
import {
  ArrowRight,
  Bell,
  Car,
  CaretDown,
  ChatCircleText,
  CheckCircle,
  Clock,
  Cube,
  DotsThree,
  DownloadSimple,
  Gauge,
  List,
  ListBullets,
  MagnifyingGlass,
  Package,
  Phone,
  Question,
  ShoppingCartSimple,
  Square,
  SquareHalfBottom,
  Tray,
  Truck,
  UserCircle,
  Users,
  Warning,
  WarningCircle,
  X,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { fontVariables } from "./fonts";
import styles from "./koncept.module.css";
import { BrandMark, PartArt } from "./Art";
import { XrayCar } from "./XrayCar";
import { demoVehicle, orders, products, rsd, type DemoOrder, type DemoProduct } from "./data";

export const viewport: Viewport = {
  themeColor: "#0D0F11",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "Koncept „Rendgen“ — SKLOP",
  robots: { index: false, follow: false },
};

const STAGES = [
  ["00", "Sklopljeno"],
  ["01", "Karoserija i svetla"],
  ["02", "Točkovi"],
  ["03", "Kočnice i vešanje"],
  ["04", "Agregati i hlađenje"],
  ["05", "Motor i turbina"],
  ["06", "Menjač i kvačilo"],
  ["07", "Izduvni sistem"],
] as const;

/** Global helpers the CSS module cannot express (pure-mode modules need a local class). */
const GLOBAL_CSS = `
html { scroll-padding-top: 80px; background: #0d0f11; color-scheme: dark; }
.sr-only-concept { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
`;

function StockLine({ stock }: { stock: DemoProduct["stock"] }) {
  switch (stock.kind) {
    case "in":
      return (
        <span className={`${styles.stock} ${styles.stockIn}`}>
          <Square weight="fill" size={12} aria-hidden="true" />
          Na stanju <span className={styles.stockQty}>· {stock.qty} kom.</span>
        </span>
      );
    case "low":
      return (
        <span className={`${styles.stock} ${styles.stockLow}`}>
          <SquareHalfBottom weight="fill" size={12} aria-hidden="true" />
          Malo na stanju <span className={styles.stockQty}>· {stock.qty} kom.</span>
        </span>
      );
    case "order":
      return (
        <span className={`${styles.stock} ${styles.stockOrder}`}>
          <Clock weight="bold" size={13} aria-hidden="true" />
          Po porudžbini <span className={styles.stockQty}>· {stock.days}</span>
        </span>
      );
    case "out":
      return (
        <span className={`${styles.stock} ${styles.stockOut}`}>
          <Square weight="regular" size={12} aria-hidden="true" />
          Nema na stanju
        </span>
      );
  }
}

function FitmentLine({ fitment }: { fitment: DemoProduct["fitment"] }) {
  if (fitment === "fits") {
    return (
      <span className={`${styles.fit} ${styles.fitOk}`}>
        <CheckCircle size={15} weight="bold" aria-hidden="true" />
        Odgovara za {demoVehicle.short}
      </span>
    );
  }
  if (fitment === "engine") {
    return (
      <span className={`${styles.fit} ${styles.fitCheck}`}>
        <Question size={15} weight="bold" aria-hidden="true" />
        Proverite oznaku motora
      </span>
    );
  }
  return null;
}

function ProductCard({ product }: { product: DemoProduct }) {
  const out = product.stock.kind === "out";
  const onOrder = product.stock.kind === "order";
  const actionLabel = out ? "Obavesti me" : onOrder ? "Poruči" : "U korpu";
  return (
    <li className={styles.card}>
      <div className={styles.thumb}>
        <PartArt art={product.art} className={styles.thumbArt} />
        <span className={styles.quality}>{product.quality}</span>
      </div>
      <div className={styles.cardBody}>
        <span className={styles.maker}>
          {product.maker}
          <span className={styles.makerQuality}> · {product.quality}</span>
        </span>
        <h3 className={styles.name}>
          <a href="#kartice">{product.name}</a>
        </h3>
        <span className={styles.codes}>
          OEM <b>{product.oem}</b>
        </span>
        <FitmentLine fitment={product.fitment} />
        <StockLine stock={product.stock} />
        {product.alternativesInStock ? (
          <a className={styles.altLink} href="#kartice">
            Zamena na stanju: {product.alternativesInStock}
            <ArrowRight size={13} weight="bold" aria-hidden="true" />
          </a>
        ) : (
          <span />
        )}
        <div className={styles.cardFoot}>
          {product.yours ? (
            <div className={styles.price}>
              <span className={styles.priceRetailStruck}>
                MP <s>{rsd(product.retail)} RSD</s>
              </span>
              <span className={styles.priceYoursLabel}>Vaša cena</span>
              <span className={`${styles.priceValue} ${styles.priceYours}`}>
                {rsd(product.yours)}
                {" "}
                <span className={styles.priceUnit}>RSD</span>
              </span>
              <span className={styles.priceNote}>sa PDV-om</span>
            </div>
          ) : (
            <div className={styles.price}>
              <span className={styles.priceValue}>
                {rsd(product.retail)}
                {" "}
                <span className={styles.priceUnit}>RSD</span>
              </span>
              <span className={styles.priceNote}>sa PDV-om</span>
            </div>
          )}
          <button
            type="button"
            className={`${styles.cardButton} ${out ? styles.cardButtonGhost : ""}`}
            aria-label={`${actionLabel}: ${product.name}`}
          >
            {out ? <Bell size={18} aria-hidden="true" /> : <ShoppingCartSimple size={18} aria-hidden="true" />}
            <span aria-hidden="true">{actionLabel}</span>
          </button>
        </div>
      </div>
    </li>
  );
}

const STATUS: Record<DemoOrder["status"], { label: string; cls: string; icon: Icon }> = {
  nova: { label: "Nova", cls: styles.stNew, icon: WarningCircle },
  potvrdjena: { label: "Potvrđena", cls: styles.stInfo, icon: CheckCircle },
  spremna: { label: "Za preuzimanje", cls: styles.stInfo, icon: Package },
  poslata: { label: "Poslata", cls: styles.stInfo, icon: Truck },
  ceka_deo: { label: "Čeka deo", cls: styles.stWarning, icon: Warning },
  otkazana: { label: "Otkazana", cls: styles.stDanger, icon: XCircle },
  isporucena: { label: "Isporučena", cls: styles.stSuccess, icon: CheckCircle },
};

function AdminFrame() {
  return (
    <div className={styles.paper}>
      <nav className={styles.sidebar} aria-label="Administracija">
        <div className={styles.sidebarBrand}>
          <BrandMark className={styles.markIcon} />
          <span className={styles.sideLabel}>SKLOP</span> <span className={`${styles.sidebarTag} ${styles.sideLabel}`}>ADMIN</span>
        </div>
        <a className={styles.sideLink} href="#admin">
          <Gauge size={18} aria-hidden="true" /> <span className={styles.sideLabel}>Pregled</span>
        </a>
        <a className={`${styles.sideLink} ${styles.sideLinkActive}`} href="#admin" aria-current="page">
          <Tray size={18} aria-hidden="true" /> <span className={styles.sideLabel}>Porudžbine</span>
          <span className={`${styles.sideCount} ${styles.sideCountHot}`} aria-label="1 nova">
            1
          </span>
        </a>
        <a className={styles.sideLink} href="#admin">
          <ChatCircleText size={18} aria-hidden="true" /> <span className={styles.sideLabel}>Upiti</span>
          <span className={styles.sideCount} aria-label="2 bez odgovora">
            2
          </span>
        </a>
        <a className={styles.sideLink} href="#admin">
          <Cube size={18} aria-hidden="true" /> <span className={styles.sideLabel}>Proizvodi</span>
        </a>
        <a className={styles.sideLink} href="#admin">
          <DownloadSimple size={18} aria-hidden="true" /> <span className={styles.sideLabel}>Uvoz iz Excela</span>
        </a>
        <a className={styles.sideLink} href="#admin">
          <Users size={18} aria-hidden="true" /> <span className={styles.sideLabel}>Majstori</span>
          <span className={styles.sideCount} aria-label="1 čeka odobrenje">
            1
          </span>
        </a>
      </nav>
      <div className={styles.workspace}>
        <div className={styles.adminBar}>
          <button type="button" className={styles.pIconButton} aria-label="Meni administracije">
            <List size={20} aria-hidden="true" />
          </button>
          <span className={styles.adminBarBrand}>
            <BrandMark className={styles.markIconSmall} /> SKLOP admin
          </span>
        </div>
        <div className={styles.workHead}>
          <h3 className={styles.workTitle}>Porudžbine</h3>
          <div className={styles.workActions}>
            <button type="button" className={styles.pButton}>
              <DownloadSimple size={16} aria-hidden="true" /> Izvoz za Excel
            </button>
            <button type="button" className={`${styles.pButton} ${styles.pButtonPrimary}`}>
              Potvrdi izabrane
            </button>
          </div>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.tabs} role="tablist" aria-label="Filter po statusu">
            <button type="button" role="tab" aria-selected="true" className={`${styles.tab} ${styles.tabActive}`}>
              Sve <span className={styles.tabCount}>187</span>
            </button>
            <button type="button" role="tab" aria-selected="false" className={styles.tab}>
              Nove <span className={styles.tabCount}>1</span>
            </button>
            <button type="button" role="tab" aria-selected="false" className={styles.tab}>
              Za slanje <span className={styles.tabCount}>2</span>
            </button>
            <button type="button" role="tab" aria-selected="false" className={styles.tab}>
              Čeka deo <span className={styles.tabCount}>1</span>
            </button>
          </div>
          <label className={styles.pSearch}>
            <MagnifyingGlass size={16} aria-hidden="true" />
            <span className="sr-only-concept">Pretraga porudžbina</span>
            <input type="search" placeholder="Broj, kupac, telefon, PIB" />
          </label>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.colCheck}>
                  <input type="checkbox" className={styles.checkbox} aria-label="Izaberi sve" />
                </th>
                <th scope="col">Broj</th>
                <th scope="col">Primljena</th>
                <th scope="col">Kupac</th>
                <th scope="col" className={styles.num}>
                  Stavke
                </th>
                <th scope="col" className={styles.num}>
                  Iznos
                </th>
                <th scope="col">Plaćanje · dostava</th>
                <th scope="col">Status</th>
                <th scope="col" className={styles.colSource}>
                  Izvor
                </th>
                <th scope="col" className={styles.colActions}>
                  <span className="sr-only-concept">Radnje</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => {
                const status = STATUS[order.status];
                const StatusIcon = status.icon;
                const number = `${order.prefix}${order.seq}`;
                return (
                  <tr key={number} className={i === 1 ? styles.rowSelected : undefined}>
                    <td className={styles.colCheck}>
                      <input type="checkbox" className={styles.checkbox} defaultChecked={i === 1} aria-label={`Izaberi ${number}`} />
                    </td>
                    <td>
                      <a className={styles.orderNo} href="#admin" aria-label={number}>
                        <span className={styles.orderPrefix}>{order.prefix}</span>
                        {order.seq}
                      </a>
                    </td>
                    <td className={styles.num}>
                      {order.date} <span className={styles.dim}>{order.time}</span>
                    </td>
                    <td>
                      <div className={styles.customer}>
                        <span>
                          {order.customer}
                          {order.mechanic ? <span className={styles.tag}>Majstor</span> : null}
                        </span>
                        {order.company ? <span className={styles.customerSub}>{order.company}</span> : null}
                      </div>
                    </td>
                    <td className={styles.num}>{order.items}</td>
                    <td className={styles.num}>{rsd(order.total)} RSD</td>
                    <td>
                      <div className={styles.customer}>
                        <span>{order.payment}</span>
                        <span className={styles.customerSub}>{order.delivery}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.status} ${status.cls}`}>
                        <StatusIcon size={14} weight="bold" aria-hidden="true" />
                        {status.label}
                      </span>
                    </td>
                    <td className={`${styles.dim} ${styles.colSource}`}>{order.source}</td>
                    <td className={styles.colActions}>
                      <button type="button" className={styles.rowAction} aria-label={`Radnje za ${number}`}>
                        <DotsThree size={20} weight="bold" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={styles.tableFoot}>
          <span>1 izabrana · 1–7 od 187</span>
          <span>Strana 1 od 27</span>
        </div>
      </div>
    </div>
  );
}

export default function KonceptPage() {
  return (
    <div className={`${fontVariables} ${styles.root}`}>
      <style>{GLOBAL_CSS}</style>
      <header className={styles.header}>
        <a className={styles.wordmark} href="#top" aria-label="SKLOP — početna">
          <BrandMark className={styles.markIcon} />
          SKLOP
        </a>
        <nav className={styles.nav} aria-label="Glavna navigacija">
          <a className={styles.navLink} href="#kartice">
            Delovi
          </a>
          <a className={styles.navLink} href="#kartice">
            Vozila
          </a>
          <a className={styles.navLink} href="#kartice">
            Za majstore
          </a>
          <a className={styles.navLink} href="#kartice">
            Upit po broju šasije
          </a>
        </nav>
        <div className={styles.headerTools}>
          <a className={styles.contactLink} href="#kontakt" aria-label="Pozovite nas">
            <Phone size={20} aria-hidden="true" />
            <span className={styles.contactText} aria-hidden="true">
              Pozovite
            </span>
          </a>
          <a className={`${styles.contactLink} ${styles.contactViber}`} href="#kontakt" aria-label="Pišite nam na Viber">
            <ChatCircleText size={20} aria-hidden="true" />
            <span className={styles.contactText} aria-hidden="true">
              Viber
            </span>
          </a>
          <button type="button" className={styles.iconButton} aria-label="Nalog">
            <UserCircle size={22} aria-hidden="true" />
          </button>
          <button type="button" className={styles.iconButton} aria-label="Korpa, 2 artikla">
            <ShoppingCartSimple size={22} aria-hidden="true" />
            <span className={styles.count} aria-hidden="true">
              2
            </span>
          </button>
          <button type="button" className={`${styles.iconButton} ${styles.mobileOnly}`} aria-label="Meni">
            <List size={22} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="top">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <h1 id="hero-title" className={styles.display}>
              <span className={styles.displayLine}>Rasklopi</span>
              <span className={styles.displayLine}>auto.</span>
              <span className={styles.displayLine}>Nađi deo.</span>
              <span className={styles.displaySub}>Delovi za VW, Audi, Škoda, SEAT i&nbsp;Cupra&nbsp;— tražite po OEM broju, po vozilu ili klikom na&nbsp;deo.</span>
            </h1>
            <form className={styles.search} action="/pretraga" role="search">
              <label className={styles.fieldLabel} htmlFor="q">
                Broj dela ili naziv
              </label>
              <div className={styles.searchField}>
                <MagnifyingGlass size={20} className={styles.searchIcon} aria-hidden="true" />
                <input
                  id="q"
                  name="q"
                  className={styles.searchInput}
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  placeholder="npr. 1K0 615 301 AA"
                  aria-describedby="q-hint"
                />
                <button type="submit" className={styles.primaryButton}>
                  Pretraži
                </button>
              </div>
              <p id="q-hint" className={styles.hint}>
                Broj upišite kako god ga imate — razmaci, tačke i crtice ne smetaju.
              </p>
            </form>
          </div>
          <div className={styles.heroAside}>
            <div className={styles.vehicle}>
              <span className={styles.fieldLabel} id="vehicle-label">
                Vaše vozilo
              </span>
              <div className={styles.vehicleField}>
                <button type="button" className={styles.vehicleButton} aria-haspopup="dialog" aria-describedby="vehicle-label">
                  <Car size={20} aria-hidden="true" />
                  <span className={styles.vehicleName}>{demoVehicle.full}</span>
                  <span className={styles.vehicleChange}>
                    <span className={styles.vehicleChangeText}>Promeni</span> <CaretDown size={14} aria-hidden="true" />
                  </span>
                </button>
                <button type="button" className={styles.vehicleClear} aria-label="Ukloni izabrano vozilo">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
            <a className={styles.textLink} href="#kartice">
              Nemate broj? Pošaljite broj šasije
            </a>
          </div>

          <div className={styles.stage}>
            <div className={styles.stageFrame} aria-hidden="true">
              <span className={`${styles.corner} ${styles.cornerTL}`} />
              <span className={`${styles.corner} ${styles.cornerTR}`} />
              <span className={`${styles.corner} ${styles.cornerBL}`} />
              <span className={`${styles.corner} ${styles.cornerBR}`} />
            </div>
            <dl className={styles.titleBlock}>
              <div className={`${styles.titleCell} ${styles.titleCellWide}`}>
                <dt className={styles.titleKey}>Prikaz</dt>
                <dd className={styles.titleValue}>Generički kompaktni hečbek, nije konkretan model</dd>
              </div>
              <div className={styles.titleCell}>
                <dt className={styles.titleKey}>Faza</dt>
                <dd className={styles.titleValueMono}>00 / 07</dd>
              </div>
              <div className={styles.titleCell}>
                <dt className={styles.titleKey}>Kategorije</dt>
                <dd className={styles.titleValueMono}>44</dd>
              </div>
              <div className={styles.titleCell}>
                <dt className={styles.titleKey}>Mere</dt>
                <dd className={styles.titleValueMono}>mm</dd>
              </div>
            </dl>
            <XrayCar />
            <p className={styles.stageNote}>Generički kompaktni hečbek, nije konkretan model · mere u&nbsp;mm</p>
          </div>

          <div className={styles.stageStrip}>
            <ol className={styles.stageList} aria-label="Faze rasklapanja">
              {STAGES.map(([num, label], i) => (
                <li key={num}>
                  <button
                    type="button"
                    className={`${styles.stageItem} ${i === 0 ? styles.stageItemActive : ""}`}
                    aria-current={i === 0 ? "step" : undefined}
                  >
                    <span className={styles.stageNum}>{num}</span>
                    {label}
                  </button>
                </li>
              ))}
            </ol>
            <p className={styles.stageCompact}>
              <span className={styles.stageNum}>00 / 07</span> Sklopljeno — skrolujte da rasklopite
            </p>
            <div className={styles.stageActions}>
              <button type="button" className={styles.quietButton}>
                <Cube size={18} aria-hidden="true" /> Rasklopi
              </button>
              <button type="button" className={styles.quietButton} aria-haspopup="dialog">
                <ListBullets size={18} aria-hidden="true" /> Lista delova
              </button>
            </div>
          </div>
        </section>

        <section id="kartice" className={styles.section} aria-labelledby="cards-title">
          <div className={styles.sectionHead}>
            <div>
              <h2 id="cards-title" className={styles.sectionTitle}>
                Delovi za Golf VII
              </h2>
              <p className={styles.sectionNote}>
                Kartica proizvoda: proizvođač i kvalitet, naziv, OEM broj, kompatibilnost sa izabranim vozilom, stanje i cena sa PDV-om. Druga kartica prikazuje cenu za odobrenog majstora.
              </p>
            </div>
            <span className={styles.demoNote}>Primer podataka · demo</span>
          </div>
          <ul className={styles.grid}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ul>
        </section>

        <section id="admin" className={styles.section} aria-labelledby="admin-title">
          <div className={styles.sectionHead}>
            <div>
              <h2 id="admin-title" className={styles.sectionTitle}>
                Administracija
              </h2>
              <p className={styles.sectionNote}>
                Radna površina je svetla (dnevno svetlo u radnji, štampa predračuna i otpremnica); navigacija ostaje u noćnoj temi brenda.
              </p>
            </div>
            <span className={styles.demoNote}>Primer podataka · demo</span>
          </div>
          <AdminFrame />
        </section>
        <footer id="kontakt" className={styles.conceptFoot}>
          <p>Koncept „Rendgen“ · korak 03 · telefon, Viber i adresa dolaze iz podešavanja i ne prikazuju se dok nisu uneti.</p>
        </footer>
      </main>
    </div>
  );
}
