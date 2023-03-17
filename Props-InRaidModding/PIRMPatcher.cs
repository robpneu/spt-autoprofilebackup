﻿using Aki.Reflection.Patching;
using BepInEx;
using Comfort.Common;
using EFT;
using EFT.InventoryLogic;
using EFT.UI;
using EFT.UI.DragAndDrop;
using EFT.UI.WeaponModding;
using JetBrains.Annotations;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Reflection.Emit;
using UnityEngine;
using UnityEngine.EventSystems;
    
namespace PIRM
{
    public class PIRMMethod17Patch : ModulePatch
    {
        protected override MethodBase GetTargetMethod()
        {
            return typeof(ItemSpecificationPanel).GetMethod("method_17", BindingFlags.NonPublic | BindingFlags.Instance);
        }

        [PatchPrefix]
        public static bool PatchPrefix(ref KeyValuePair<EModLockedState, string> __result, Slot slot)
        {
            string text = (slot.ContainedItem != null) ? slot.ContainedItem.Name.Localized(null) : string.Empty;
            __result = new KeyValuePair<EModLockedState, string>(EModLockedState.Unlocked, text);

            return false;
        }
    }

   

    // THIS METHOD IS Causing an issue of not being able to move items back at all probably.... or maybe need new one for itemspecifcationpanel
    public class PIRMGlass2426Smethod1 : ModulePatch
    {
        protected override MethodBase GetTargetMethod()
        {
            return typeof(GClass2426).GetMethod("smethod_1", BindingFlags.NonPublic | BindingFlags.Static);
        }

        [PatchPrefix]
        public static bool Prefix(Item item, ItemAddress to, TraderControllerClass itemController, ref GStruct323<GClass2894> __result)
        {

            if (GClass1754.InRaid)
            {
                __result = GClass2894._;
                return false;
            }

            return true;
        }
    }

    public class SlotViewMethod2 : ModulePatch
    {
        protected override MethodBase GetTargetMethod()
        {
            return typeof(EFT.InventoryLogic.Item).GetMethod("CheckAction", BindingFlags.Public | BindingFlags.Instance);
        }

        [PatchPrefix]
        static bool Prefix(Item __instance, [CanBeNull] ItemAddress location, ref bool __result)
        {
            // Set the result to true and return false to skip the original method
            __result = true;
            return false;
        }

    }


    //need this one
    public class EFTInventoryLogicModPatch : ModulePatch
    {
        protected override MethodBase GetTargetMethod()
        {
            return typeof(EFT.InventoryLogic.Mod).GetMethod("CanBeMoved", BindingFlags.Public | BindingFlags.Instance);
        }

        [PatchPrefix]
        static bool Prefix(IContainer toContainer, ref GStruct323<bool> __result)
        {
            __result = true;
            return false;
        }

    }

    /*    public class PIRMGlass2426Smethod2 : ModulePatch
        {
            protected override MethodBase GetTargetMethod()
            {
                return typeof(GClass2426).GetMethod("smethod_2", BindingFlags.NonPublic | BindingFlags.Static);
            }

            [PatchPrefix]
            static bool Prefix(ItemAddress to, ref IContainer __result)
            {
                __result = null;
                return false;
            }
        }*/

    /*public class Glass2426CheckMissingParts: ModulePatch
    {
        protected override MethodBase GetTargetMethod()
        {
            return typeof(GClass2426).GetMethod("CheckMissingParts", BindingFlags.Public | BindingFlags.Static);
        }

        [PatchPrefix]
        static bool Prefix(LootItemClass compoundItem, ItemAddress to, TraderControllerClass itemController, out Slot.GClass2863 error)
        {
            error = null;
            return true;
        }
    }*/






}
