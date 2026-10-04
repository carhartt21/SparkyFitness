# Food Search

This page will explain how to search for food items in X on Track.
When you click on Add food, you'll have the option to search for recent foods:
<img width="1109" height="389" alt="grafik" src="https://github.com/user-attachments/assets/54276539-7034-4dbc-bee3-b3a4d84e3a57" />

You'll also have the option to search for Food online using your configured Food data providers or even scan a Barcode:
<img width="1101" height="733" alt="grafik" src="https://github.com/user-attachments/assets/ed2dfd2c-cd8f-4d57-8b23-f4171ec89cd5" />

## Provider serving sizes

Open Food Facts imports retain a declared serving's weight or volume alongside
the metric nutrition reference. In the mobile quantity picker, select the portion
and enter how many you ate. For example, a source declaring one 21.5 g portion
lets you log two portions as 43 g, with nutrition scaled to that amount. A whole
package is not assumed to be one serving.

The automatic import-scaling preference controls the metric default. The
declared portion remains available with its own correctly scaled nutrition even
when the metric default stays at 100 g or 100 ml. A provider description without
a usable weight does not create a guessed gram equivalent.

Existing saved foods can retain older serving information. On mobile, choose a
fresh provider search result and save or log it to append missing portions. A
barcode lookup that finds an existing local food returns that saved record first.
Historical diary nutrition stays unchanged. You can also manage portions from
the food's edit screen.
