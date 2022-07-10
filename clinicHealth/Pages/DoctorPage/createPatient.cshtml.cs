using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Data.SqlClient;
namespace clinicHealth.Pages.DoctorPage
{
    public class createPatientModel : PageModel
    {
        public Patients patient = new Patients();
        public String errorMessage = "";
        public String successMessage = "";
      
        public void OnGet()
        {
        }
        public void OnPost()
        {
            String id = Request.Query["id"];
            patient.full_name = Request.Form["name"];
            patient.year_of_birth = Request.Form["year"];
            patient.Age = Convert.ToInt32(Request.Form["Age"]);
            patient.Symptoms= Request.Form["Sym"];
            patient.Allergies = Request.Form["All"];
            patient.visit_date = Request.Form["Visit"];
            if (patient.full_name.Length == 0 || patient.year_of_birth.Length == 0|| patient.Age.ToString().Length ==0 || patient.Symptoms.Length == 0 || patient.Allergies.ToString().Length == 0 || patient.visit_date.Length == 0  )
            {
                errorMessage = "All Fields are Required";
                return;

            }
            try
            {
                String connectionString = "Data Source=.;Initial Catalog=Clinic;Integrated Security=True";
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    connection.Open();
                    String query = "INSERT INTO Patient" +
                                   "(full_name,year_of_birth,Age,Symptoms,Allergies,visit_date,doctor_id) VALUES " +
                                   "(@full_name,@year,@Age,@Sym,@All,@visit_date,@doctor_id);";
                    using (SqlCommand command = new SqlCommand(query, connection))
                    {
                        command.Parameters.AddWithValue("@full_name", patient.full_name);
                        command.Parameters.AddWithValue("@year", patient.year_of_birth);
                        command.Parameters.AddWithValue("@Age", patient.Age);
                        command.Parameters.AddWithValue("@Sym", patient.Symptoms);
                        command.Parameters.AddWithValue("@All", patient.Allergies);
                        command.Parameters.AddWithValue("@visit_date", patient.visit_date);
                        command.Parameters.AddWithValue("@doctor_id",Convert.ToInt32(id));
                        command.ExecuteNonQuery();
                    }
                }

            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
                return;

            }
          
            successMessage = "New Docotr has Been Added!";
            Response.Redirect("/DoctorPage/patient?id="+ Request.Query["id"]);
        }
    }
}
