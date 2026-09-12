import React, { useEffect, useState } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { Link, useLocation } from "react-router-dom";
import { safeJsonParse } from "@/utils/request";
import { isPathMatch } from "@/utils/paths";
import useScrollActiveItemIntoView from "@/hooks/useScrollActiveItemIntoView";

export default function MenuOption({
  btnText,
  icon,
  href,
  childOptions = [],
  flex = false,
  user = null,
  roles = [],
  hidden = false,
  isChild = false,
  searchFilter = "",
}) {
  const storageKey = generateStorageKey({ key: btnText });
  const location = useLocation();
  const hasChildren = childOptions.length > 0;
  const hasVisibleChildren = hasVisibleOptions(user, childOptions);
  const { isExpanded, setIsExpanded } = useIsExpanded({
    storageKey,
    hasVisibleChildren,
    childOptions,
    location: location.pathname,
  });

  const query = searchFilter?.trim().toLowerCase() || "";
  const selfMatches = query ? btnText.toLowerCase().includes(query) : true;
  const anyChildMatches = query
    ? childOptions.some((c) => c.btnText?.toLowerCase().includes(query))
    : false;

  if (query && !selfMatches && !anyChildMatches) {
    return null;
  }

  const expanded = query && anyChildMatches ? true : isExpanded;

  const isActive = hasChildren
    ? (!expanded &&
        childOptions.some((child) =>
          isPathMatch(child.href, location.pathname)
        )) ||
      location.pathname === href
    : isPathMatch(href, location.pathname);

  const { ref } = useScrollActiveItemIntoView({
    isActive,
    behavior: "instant",
    block: "center",
  });

  if (hidden) return null;

  // If this option is a parent level option
  if (!isChild) {
    // and has no children then use its flex props and roles prop directly
    if (!hasChildren) {
      if (!flex && !roles.includes(user?.role)) return null;
      if (flex && !!user && !roles.includes(user?.role)) return null;
    }

    // if has children and no visible children - remove it.
    if (hasChildren && !hasVisibleChildren) return null;
  } else {
    // is a child so we use it's permissions
    if (!flex && !roles.includes(user?.role)) return null;
    if (flex && !!user && !roles.includes(user?.role)) return null;
  }

  const handleClick = (e) => {
    if (hasChildren) {
      e.preventDefault();
      const newExpandedState = !isExpanded;
      setIsExpanded(newExpandedState);
      localStorage.setItem(storageKey, JSON.stringify(newExpandedState));
    }
  };

  return (
    <div className="w-full">
      <div
        className={`
          flex items-center justify-between w-full
          transition-all duration-200
          rounded-lg my-0.5 group
          ${
            isActive
              ? "bg-indigo-600/15 text-indigo-300 font-medium border-l-2 border-indigo-500 shadow-sm"
              : "text-theme-text-secondary hover:text-white hover:bg-white/5"
          }
        `}
      >
        <Link
          ref={ref}
          to={href}
          className={`flex flex-grow items-center px-3 font-medium transition-colors ${
            isChild ? "h-8 text-xs pl-4" : "h-9 text-sm"
          }`}
          onClick={hasChildren ? handleClick : undefined}
        >
          {icon && (
            <span
              className={`shrink-0 mr-2.5 transition-colors ${
                isActive
                  ? "text-indigo-400"
                  : "text-theme-text-secondary group-hover:text-white"
              }`}
            >
              {icon}
            </span>
          )}
          <p
            className={`whitespace-nowrap overflow-hidden text-ellipsis ${
              isActive
                ? "text-white font-semibold"
                : isChild
                ? "text-theme-text-secondary/80 group-hover:text-white"
                : "text-theme-text-secondary group-hover:text-white"
            } ${!icon && !isChild ? "pl-2" : ""}`}
          >
            {btnText}
          </p>
        </Link>
        {hasChildren && (
          <button
            onClick={handleClick}
            className="p-2 text-theme-text-secondary hover:text-white transition-colors"
            title={expanded ? "Collapse" : "Expand"}
          >
            <CaretRight
              size={13}
              weight="bold"
              className={`transition-transform duration-200 ${
                expanded ? "rotate-90 text-indigo-400" : "text-white/40"
              }`}
            />
          </button>
        )}
      </div>
      {expanded && hasChildren && (
        <div className="ml-3.5 pl-2.5 border-l border-white/10 space-y-0.5 my-1">
          {childOptions.map((childOption, index) => (
            <MenuOption
              key={index}
              {...childOption} // flex and roles go here.
              user={user}
              isChild={true}
              searchFilter={searchFilter}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function useIsExpanded({
  storageKey = "",
  hasVisibleChildren = false,
  childOptions = [],
  location = null,
}) {
  const [isExpanded, setIsExpanded] = useState(() => {
    if (hasVisibleChildren) {
      const storedValue = localStorage.getItem(storageKey);
      if (storedValue !== null) {
        return safeJsonParse(storedValue, false);
      }
      return childOptions.some((child) => isPathMatch(child.href, location));
    }
    return false;
  });

  useEffect(() => {
    if (hasVisibleChildren) {
      const shouldExpand = childOptions.some((child) =>
        isPathMatch(child.href, location)
      );
      if (shouldExpand && !isExpanded) {
        setIsExpanded(true);
        localStorage.setItem(storageKey, JSON.stringify(true));
      }
    }
  }, [location]);

  return { isExpanded, setIsExpanded };
}

/**
 * Checks if the child options are visible to the user.
 * This hides the top level options if the child options are not visible
 * for either the users permissions or the child options hidden prop is set to true by other means.
 * If all child options return false for `isVisible` then the parent option will not be visible as well.
 * @param {object} user - The user object.
 * @param {array} childOptions - The child options.
 * @returns {boolean} - True if the child options are visible, false otherwise.
 */
function hasVisibleOptions(user = null, childOptions = []) {
  if (!Array.isArray(childOptions) || childOptions?.length === 0) return false;

  function isVisible({
    roles = [],
    user = null,
    flex = false,
    hidden = false,
  }) {
    if (hidden) return false;
    if (!flex && !roles.includes(user?.role)) return false;
    if (flex && !!user && !roles.includes(user?.role)) return false;
    return true;
  }

  return childOptions.some((opt) =>
    isVisible({ roles: opt.roles, user, flex: opt.flex, hidden: opt.hidden })
  );
}

function generateStorageKey({ key = "" }) {
  const _key = key.replace(/\s+/g, "_").toLowerCase();
  return `anything_llm_menu_${_key}_expanded`;
}
