export const headerControlClass =
  "inline-flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-primary-content/85 hover:bg-base-100/15 hover:text-primary-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-content/50 transition-colors group-open:bg-base-100/20 group-open:text-primary-content";

export const headerMenuItemClass =
  `${headerControlClass} list-none cursor-pointer [&::-webkit-details-marker]:hidden`;

export const headerMenuItemActiveClass = "bg-base-100/20 text-primary-content font-semibold";

export const getHeaderMenuItemClass = (active: boolean) =>
  active ? `${headerMenuItemClass} ${headerMenuItemActiveClass}` : headerMenuItemClass;
