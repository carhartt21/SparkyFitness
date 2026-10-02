# Preferences

This page explains how to manage preference settings in **X on Track**.

---

## Autoscaling OpenFoodFacts

The **Auto-scale OpenFoodFacts imports** option uses a known provider serving size to create a serving-based variant. The nutrition and serving denominator must be scaled together; per-100-g/per-100-ml values remain available for comparison.

An unknown or unparseable serving size is not a conversion factor. Do not assume a portion equals 100 g or 100 ml; retain the known weight/volume variant or add a measured serving yourself.

In quantity entry, grams/millilitres represent mass/volume; a named serving represents a **count of that serving**. For example, two slices of 7.1 g total 14.2 g. Check the displayed total after switching units. A provider's label and your saved variant may differ; use the selected variant's actual factor.

The screenshots below illustrate the upstream import/variant workflow in an earlier interface. They are not current X on Track visual references. For other settings see [Settings overview](/features/user-settings).

---

### Comparison

#### Without Import Autoscaling (Default)

<img width="896" height="424" alt="b3f00535a4036a515d1be85306b3ece3" src="https://github.com/user-attachments/assets/ca771c26-b1b6-426f-ad10-ebaf583aa35b" />

#### With Import Autoscaling

<img width="896" height="424" alt="d810e2f5044afed7c81aeebb9d8de943" src="https://github.com/user-attachments/assets/cb7306a4-90a7-431b-9f4d-13f5705291be" />

---

## Complete Import Process

### Using OpenFoodFacts Import Autoscaling

### 1. Add Food

Add food as normal via **“Online”** or **“Scan Barcode”**.

- A valid serving can become the imported variant's basis. Search comparisons can still display normalized **per-100-g/per-100-ml** nutrition.

<img width="897" height="425" alt="07a8da919f7c561f333a4cae55b2b77f" src="https://github.com/user-attachments/assets/b90794d9-7148-406a-a554-394d4cc50772" />

---

### 2. Edit and Add

It may still be useful to keep a **gram-based Unit Variant**, especially for cases where weight-based measurements are needed.

> **Note:** “Auto-scale” in the _Edit Food Details_ dialog scales measurements for that specific variant only. It is separate from OpenFoodFacts import scaling and changes the variant's serving size and nutrition together.

#### A. Duplicate the gram measurement

<img width="897" height="758" alt="9dca897ac0a85f59b13cc9c12707c4ad" src="https://github.com/user-attachments/assets/11d32341-4c31-461c-8972-2f7117a315a2" />

#### B. Edit unit type and optionally set it as the default

<img width="898" height="830" alt="714194fae6738bbc29ba96917125a706" src="https://github.com/user-attachments/assets/4ef7b52a-be74-4adc-9012-2f1ae3fc1467" />

#### C. Save the Food

Click **“Add Food”** or **“Update Food”**.

---

### 3. Using the New Entry

#### A. Defaults to your Unit Variant (no more math!)

<img width="512" height="368" alt="89d7b76d61d30524d32a260718584b11" src="https://github.com/user-attachments/assets/87e39cf9-d75f-4fe1-9036-a7287802e331" />

#### B. Referencing grams if needed

You can switch the unit back to **grams** and adjust the quantity accordingly.

<img width="513" height="369" alt="807d02e78eae51dc6cb33e47dbdd1a84" src="https://github.com/user-attachments/assets/dbd34d75-6764-4fd2-ac68-2d4a08889551" />
